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
import { hasProcessingIntent } from '@/utils/journal/processing-intent';

interface JournalEntriesListProps {
  entries: JournalEntry[];
  loading: boolean;
  processingEntries: string[];
  processedEntryIds: number[];
  onStartRecording: () => void;
  onDeleteEntry: (entryId: number) => void;
  onUpdateEntry?: (entryId: number, newContent: string, isProcessing?: boolean) => void;
  isSavingRecording?: boolean;
}

const JournalEntriesList: React.FC<JournalEntriesListProps> = ({
  entries,
  loading,
  processingEntries,
  processedEntryIds,
  onStartRecording,
  onDeleteEntry,
  onUpdateEntry,
  isSavingRecording = false,
}) => {
  const { 
    visibleEntries, 
    isVisible, 
    forceRefresh, 
    immediateProcessingCount,
    hasAnyProcessing,
    isImmediatelyProcessing 
  } = useProcessingEntries();
  
  // CRITICAL: Enhanced state for immediate processing detection
  const [hasImmediateProcessing, setHasImmediateProcessing] = useState<boolean>(false);
  const [emergencyProcessingFlag, setEmergencyProcessingFlag] = useState<boolean>(false);
  const [processingIntentActive, setProcessingIntentActive] = useState<boolean>(false);
  const processingIntentRef = useRef<boolean>(false);
  
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [fallbackProcessingIds, setFallbackProcessingIds] = useState<string[]>([]);
  const deletedEntryIdsRef = useRef<Set<number>>(new Set());
  
  const hasEntries = entries && entries.length > 0;
  const isLoading = loading && !hasEntries;
  
  // CRITICAL: Monitor isSavingRecording prop for immediate processing detection
  useEffect(() => {
    if (isSavingRecording) {
      console.log('[JournalEntriesList] isSavingRecording detected - setting emergency processing');
      setEmergencyProcessingFlag(true);
      setHasImmediateProcessing(true);
      processingIntentRef.current = true;
    } else if (!hasProcessingIntent() && processingEntries.length === 0) {
      // Only clear flags if no other processing is happening
      setEmergencyProcessingFlag(false);
      setHasImmediateProcessing(false);
      processingIntentRef.current = false;
    }
  }, [isSavingRecording, processingEntries.length]);
  
  // CRITICAL: Monitor processing intent directly
  useEffect(() => {
    const checkProcessingIntent = () => {
      const intentActive = hasProcessingIntent();
      setProcessingIntentActive(intentActive);
      if (intentActive) {
        setHasImmediateProcessing(true);
        setEmergencyProcessingFlag(true);
        processingIntentRef.current = true;
      }
    };
    
    checkProcessingIntent();
    const interval = setInterval(checkProcessingIntent, 100);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    console.log('[JournalEntriesList] Component mounted');
    setLastAction('Component Mounted');
    
    // IMMEDIATE event handlers - no delays, synchronous updates
    const handleImmediateProcessingStarted = (event: CustomEvent) => {
      console.log('[JournalEntriesList] IMMEDIATE processing started event received:', event.detail);
      // SYNCHRONOUS state updates
      setHasImmediateProcessing(true);
      setEmergencyProcessingFlag(true);
      processingIntentRef.current = true;
      forceRefresh();
    };
    
    const handleProcessingStarted = (event: CustomEvent) => {
      console.log('[JournalEntriesList] Processing started event received:', event.detail);
      // SYNCHRONOUS state updates
      setHasImmediateProcessing(true);
      setEmergencyProcessingFlag(true);
      processingIntentRef.current = true;
      
      if (event.detail?.tempId) {
        setFallbackProcessingIds(prev => {
          if (!prev.includes(event.detail.tempId)) {
            console.log('[JournalEntriesList] Adding fallback processing ID:', event.detail.tempId);
            return [...prev, event.detail.tempId];
          }
          return prev;
        });
      }
      forceRefresh();
    };
    
    const handleProcessingCompleted = (event: CustomEvent) => {
      console.log('[JournalEntriesList] Processing completed event received:', event.detail);
      if (event.detail?.tempId) {
        setFallbackProcessingIds(prev => prev.filter(id => id !== event.detail.tempId));
      }
      
      // Only clear flags if no more processing
      setTimeout(() => {
        const stillProcessing = processingStateManager.hasAnyImmediateProcessing() || 
                              hasProcessingIntent() || 
                              isSavingRecording;
        if (!stillProcessing) {
          setHasImmediateProcessing(false);
          setEmergencyProcessingFlag(false);
          processingIntentRef.current = false;
        }
      }, 100);
    };
    
    // Listen for processing intent events
    const handleProcessingIntent = (event: CustomEvent) => {
      console.log('[JournalEntriesList] Processing intent event received:', event.detail);
      setEmergencyProcessingFlag(true);
      processingIntentRef.current = true;
      setHasImmediateProcessing(true);
    };
    
    window.addEventListener('immediateProcessingStarted', handleImmediateProcessingStarted as EventListener);
    window.addEventListener('processingStarted', handleProcessingStarted as EventListener);
    window.addEventListener('processingEntryCompleted', handleProcessingCompleted as EventListener);
    window.addEventListener('processingEntryHidden', handleProcessingCompleted as EventListener);
    window.addEventListener('processingIntent', handleProcessingIntent as EventListener);
    
    return () => {
      console.log('[JournalEntriesList] Component unmounted');
      window.removeEventListener('immediateProcessingStarted', handleImmediateProcessingStarted as EventListener);
      window.removeEventListener('processingStarted', handleProcessingStarted as EventListener);
      window.removeEventListener('processingEntryCompleted', handleProcessingCompleted as EventListener);
      window.removeEventListener('processingEntryHidden', handleProcessingCompleted as EventListener);
      window.removeEventListener('processingIntent', handleProcessingIntent as EventListener);
    };
  }, [forceRefresh, isSavingRecording]);
  
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
          
          // Clear emergency flags if this was the last processing entry
          setTimeout(() => {
            const stillProcessing = processingStateManager.hasAnyImmediateProcessing() || 
                                  hasProcessingIntent() || 
                                  isSavingRecording;
            if (!stillProcessing) {
              setHasImmediateProcessing(false);
              setEmergencyProcessingFlag(false);
              processingIntentRef.current = false;
            }
          }, 100);
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

  // Create a setEntries function to pass to JournalEntryCard
  const setEntries = onUpdateEntry ? (updateFn: React.SetStateAction<any[]>) => {
    if (typeof updateFn === 'function') {
      // Handle the functional update case
      const currentEntries = entries;
      const updatedEntries = updateFn(currentEntries);
      
      // Find the changed entry and call onUpdateEntry
      updatedEntries.forEach((updatedEntry: any) => {
        const originalEntry = currentEntries.find(e => e.id === updatedEntry.id);
        if (originalEntry && originalEntry.content !== updatedEntry.content) {
          onUpdateEntry(updatedEntry.id, updatedEntry.content);
        }
      });
    }
  } : null;
  
  // Filter entries to remove deleted ones
  const filteredEntries = entries.filter(entry => !deletedEntryIdsRef.current.has(entry.id));
  
  // CRITICAL: Enhanced processing detection with multiple fallbacks
  const visibleProcessingIds = visibleEntries.map(entry => entry.tempId);
  const allProcessingIds = [...new Set([...visibleProcessingIds, ...fallbackProcessingIds])];
  
  // Check state manager directly as final fallback
  const directProcessingEntries = processingStateManager.getVisibleProcessingEntries();
  const directProcessingIds = directProcessingEntries.map(entry => entry.tempId);
  const finalProcessingIds = [...new Set([...allProcessingIds, ...directProcessingIds])];
  
  // CRITICAL: Multiple checks for immediate processing - FIXED LOGIC
  const isCurrentlyProcessing = 
    isSavingRecording || // EMERGENCY: Check isSavingRecording first
    hasImmediateProcessing || 
    emergencyProcessingFlag || 
    processingIntentRef.current ||
    processingIntentActive ||
    processingStateManager.hasProcessingIntent() ||
    processingStateManager.hasAnyImmediateProcessing() ||
    hasAnyProcessing() || 
    immediateProcessingCount > 0 ||
    finalProcessingIds.length > 0;
  
  console.log(`[JournalEntriesList] Processing detection: isSavingRecording=${isSavingRecording}, isCurrentlyProcessing=${isCurrentlyProcessing}, finalProcessingIds=${finalProcessingIds.length}, filteredEntries=${filteredEntries.length}`);

  // CRITICAL: FIXED conditional logic - prioritize processing over empty state
  const shouldShowProcessing = isCurrentlyProcessing;
  const shouldShowEntries = filteredEntries.length > 0;
  const shouldShowEmpty = !shouldShowProcessing && !shouldShowEntries && !isLoading;
  
  console.log(`[JournalEntriesList] Display logic: shouldShowProcessing=${shouldShowProcessing}, shouldShowEntries=${shouldShowEntries}, shouldShowEmpty=${shouldShowEmpty}, isLoading=${isLoading}`);
  
  return (
    <div className="journal-entries-list" id="journal-entries-container" data-last-action={lastAction}>
      <JournalEntriesHeader onStartRecording={onStartRecording} />

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">
            <TranslatableText text="Loading journal entries..." />
          </p>
        </div>
      ) : shouldShowProcessing ? (
        <div className="grid gap-4" data-entries-count={filteredEntries.length}>
          {/* CRITICAL: Show processing cards FIRST with forced visibility */}
          <div data-processing-cards-container="true" className="processing-cards-container">
            {finalProcessingIds.length > 0 ? (
              finalProcessingIds.map((tempId) => {
                const entry = processingStateManager.getEntryById(tempId);
                const shouldShow = entry ? isVisible(tempId) : true;
                
                console.log(`[JournalEntriesList] Rendering processing card for: ${tempId}, visible: ${shouldShow}, hasEntry: ${!!entry}`);
                
                return (
                  <JournalEntryLoadingSkeleton
                    key={`processing-${tempId}`}
                    count={1}
                    tempId={tempId}
                    isVisible={true} // FORCE VISIBLE during immediate processing
                  />
                );
              })
            ) : (
              // Emergency fallback - show a loading card even without tempId
              <JournalEntryLoadingSkeleton
                key="emergency-processing"
                count={1}
                tempId="emergency-loading"
                isVisible={true}
              />
            )}
          </div>
          
          {/* Display regular entries if any exist */}
          {shouldShowEntries && filteredEntries.map((entry) => {
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
                setEntries={setEntries}
              />
            );
          })}
        </div>
      ) : shouldShowEntries ? (
        <div className="grid gap-4" data-entries-count={filteredEntries.length}>
          {/* Display regular entries only */}
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
                setEntries={setEntries}
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
