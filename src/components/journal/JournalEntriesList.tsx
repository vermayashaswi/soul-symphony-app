
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
import { smartUIDetector } from '@/utils/journal/smart-ui-detector';

interface JournalEntriesListProps {
  entries: JournalEntry[];
  loading: boolean;
  processingEntries: string[];
  processedEntryIds: number[];
  onStartRecording: () => void;
  onDeleteEntry: (entryId: number) => void;
  isSavingRecording?: boolean;
}

const JournalEntriesList: React.FC<JournalEntriesListProps> = ({
  entries,
  loading,
  processingEntries,
  processedEntryIds,
  onStartRecording,
  onDeleteEntry,
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
  
  // Simplified state for immediate processing detection
  const [hasImmediateProcessing, setHasImmediateProcessing] = useState<boolean>(false);
  const [processingIntentActive, setProcessingIntentActive] = useState<boolean>(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [fallbackProcessingIds, setFallbackProcessingIds] = useState<string[]>([]);
  const deletedEntryIdsRef = useRef<Set<number>>(new Set());
  
  const hasEntries = entries && entries.length > 0;
  const isLoading = loading && !hasEntries;
  
  // IMMEDIATE monitoring for isSavingRecording prop
  useEffect(() => {
    if (isSavingRecording) {
      console.log('[JournalEntriesList] isSavingRecording detected - setting immediate processing');
      setHasImmediateProcessing(true);
    } else {
      // Only clear if no other processing is happening
      const stillProcessing = hasProcessingIntent() || 
                            processingEntries.length > 0 || 
                            visibleEntries.length > 0;
      if (!stillProcessing) {
        setHasImmediateProcessing(false);
      }
    }
  }, [isSavingRecording, processingEntries.length, visibleEntries.length]);
  
  // IMMEDIATE monitoring for processing intent
  useEffect(() => {
    const checkProcessingIntent = () => {
      const intentActive = hasProcessingIntent();
      setProcessingIntentActive(intentActive);
      if (intentActive) {
        setHasImmediateProcessing(true);
      }
    };
    
    checkProcessingIntent();
    const interval = setInterval(checkProcessingIntent, 50); // Reduced from 100ms to 50ms
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    console.log('[JournalEntriesList] Component mounted');
    setLastAction('Component Mounted');
    
    // Start Smart UI Detector
    smartUIDetector.startWatching();
    
    // IMMEDIATE event handlers - completely synchronous
    const handleImmediateProcessingStarted = (event: CustomEvent) => {
      console.log('[JournalEntriesList] IMMEDIATE processing started event received:', event.detail);
      setHasImmediateProcessing(true);
      forceRefresh();
    };
    
    const handleProcessingStarted = (event: CustomEvent) => {
      console.log('[JournalEntriesList] Processing started event received:', event.detail);
      setHasImmediateProcessing(true);
      
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
      
      // IMMEDIATE clearing - no timeouts
      const stillProcessing = processingStateManager.hasAnyImmediateProcessing() || 
                            hasProcessingIntent() || 
                            isSavingRecording;
      if (!stillProcessing) {
        setHasImmediateProcessing(false);
      }
    };
    
    const handleProcessingIntent = (event: CustomEvent) => {
      console.log('[JournalEntriesList] Processing intent event received:', event.detail);
      setHasImmediateProcessing(true);
    };

    const handleSmartUICleanup = (event: CustomEvent) => {
      console.log('[JournalEntriesList] Smart UI cleanup event received:', event.detail);
      if (event.detail?.tempId) {
        setFallbackProcessingIds(prev => prev.filter(id => id !== event.detail.tempId));
      }
      forceRefresh();
    };
    
    window.addEventListener('immediateProcessingStarted', handleImmediateProcessingStarted as EventListener);
    window.addEventListener('processingStarted', handleProcessingStarted as EventListener);
    window.addEventListener('processingEntryCompleted', handleProcessingCompleted as EventListener);
    window.addEventListener('processingEntryHidden', handleProcessingCompleted as EventListener);
    window.addEventListener('processingIntent', handleProcessingIntent as EventListener);
    window.addEventListener('smartUICleanup', handleSmartUICleanup as EventListener);
    
    return () => {
      console.log('[JournalEntriesList] Component unmounted');
      smartUIDetector.stopWatching();
      window.removeEventListener('immediateProcessingStarted', handleImmediateProcessingStarted as EventListener);
      window.removeEventListener('processingStarted', handleProcessingStarted as EventListener);
      window.removeEventListener('processingEntryCompleted', handleProcessingCompleted as EventListener);
      window.removeEventListener('processingEntryHidden', handleProcessingCompleted as EventListener);
      window.removeEventListener('processingIntent', handleProcessingIntent as EventListener);
      window.removeEventListener('smartUICleanup', handleSmartUICleanup as EventListener);
    };
  }, [forceRefresh, isSavingRecording]);
  
  // Handle entries that have both ID and tempId (completed processing) - IMMEDIATE cleanup
  useEffect(() => {
    entries.forEach(entry => {
      if (entry.id && entry.tempId) {
        const processingEntry = processingStateManager.getEntryById(entry.tempId);
        
        if (processingEntry && processingEntry.state !== EntryProcessingState.COMPLETED) {
          console.log(`[JournalEntriesList] Found entry with both id and tempId: ${entry.id} / ${entry.tempId} - marking as completed`);
          processingStateManager.updateEntryState(entry.tempId, EntryProcessingState.COMPLETED);
          processingStateManager.setEntryId(entry.tempId, entry.id);
          
          // Remove from fallback state IMMEDIATELY
          setFallbackProcessingIds(prev => prev.filter(id => id !== entry.tempId));
          
          // IMMEDIATE clearing - no delays
          const stillProcessing = processingStateManager.hasAnyImmediateProcessing() || 
                                hasProcessingIntent() || 
                                isSavingRecording;
          if (!stillProcessing) {
            setHasImmediateProcessing(false);
          }
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
  
  // SIMPLIFIED processing detection with immediate checks
  const visibleProcessingIds = visibleEntries.map(entry => entry.tempId);
  const allProcessingIds = [...new Set([...visibleProcessingIds, ...fallbackProcessingIds])];
  
  // Check state manager directly as final fallback
  const directProcessingEntries = processingStateManager.getVisibleProcessingEntries();
  const directProcessingIds = directProcessingEntries.map(entry => entry.tempId);
  const finalProcessingIds = [...new Set([...allProcessingIds, ...directProcessingIds])];
  
  // SIMPLIFIED processing detection - prioritize immediate indicators
  const isCurrentlyProcessing = 
    isSavingRecording || 
    hasImmediateProcessing || 
    processingIntentActive ||
    processingStateManager.hasProcessingIntent() ||
    processingStateManager.hasAnyImmediateProcessing() ||
    hasAnyProcessing() || 
    immediateProcessingCount > 0 ||
    finalProcessingIds.length > 0;
  
  console.log(`[JournalEntriesList] Processing detection: isSavingRecording=${isSavingRecording}, isCurrentlyProcessing=${isCurrentlyProcessing}, finalProcessingIds=${finalProcessingIds.length}, filteredEntries=${filteredEntries.length}`);

  // Entry visibility coordination - prevent overlap
  const activeProcessingTempIds = new Set(finalProcessingIds);
  const entriesWithActiveLoaders = filteredEntries.filter(entry => 
    entry.tempId && activeProcessingTempIds.has(entry.tempId)
  );
  
  // Only show processed entries if their loader is NOT active
  const entriesWithoutActiveLoaders = filteredEntries.filter(entry => 
    !entry.tempId || !activeProcessingTempIds.has(entry.tempId)
  );
  
  // SIMPLIFIED conditional logic - prevent simultaneous display
  const shouldShowProcessing = isCurrentlyProcessing;
  const shouldShowEntries = entriesWithoutActiveLoaders.length > 0 && !isCurrentlyProcessing;
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
          {/* Show processing cards FIRST with IMMEDIATE visibility */}
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
          
          {/* Show entries WITHOUT active loaders only (prevents overlap) */}
          {shouldShowEntries && entriesWithoutActiveLoaders.map((entry) => {
            const entryIsProcessing = entry.tempId ? processingStateManager.isProcessing(entry.tempId) : false;
            
            return (
              <div 
                key={entry.id || entry.tempId || Math.random()}
                className="opacity-0 animate-in fade-in-0 duration-300"
                style={{ animationDelay: '100ms' }}
              >
                <JournalEntryCard
                  entry={{
                    ...entry,
                    content: entry.content || entry["refined text"] || entry["transcription text"] || ""
                  }}
                  processing={entryIsProcessing}
                  processed={processedEntryIds.includes(entry.id)}
                  onDelete={handleDeleteEntry}
                  setEntries={null}
                />
              </div>
            );
          })}
        </div>
      ) : shouldShowEntries ? (
        <div className="grid gap-4" data-entries-count={entriesWithoutActiveLoaders.length}>
          {/* Display regular entries only (without active loaders) */}
          {entriesWithoutActiveLoaders.map((entry) => {
            const entryIsProcessing = entry.tempId ? processingStateManager.isProcessing(entry.tempId) : false;
            
            return (
              <div 
                key={entry.id || entry.tempId || Math.random()}
                className="opacity-0 animate-in fade-in-0 duration-300"
                style={{ animationDelay: '50ms' }}
              >
                <JournalEntryCard
                  entry={{
                    ...entry,
                    content: entry.content || entry["refined text"] || entry["transcription text"] || ""
                  }}
                  processing={entryIsProcessing}
                  processed={processedEntryIds.includes(entry.id)}
                  onDelete={handleDeleteEntry}
                  setEntries={null}
                />
              </div>
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
