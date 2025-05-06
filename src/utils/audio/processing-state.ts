
/**
 * Global state management for audio processing
 * This helps coordinate between components during processing
 */

// In-memory store for processing entries
let processingEntries: string[] = [];
let processedEntryIds: number[] = [];
let lastUpdate: number = 0;
let lastDispatchTime: number = 0;
const MIN_DISPATCH_INTERVAL = 50; // minimum ms between dispatches

// Add or remove an entry from processing state
export function updateProcessingEntries(
  entryId: string | number,
  action: 'add' | 'remove' | 'complete'
): void {
  const now = Date.now();
  lastUpdate = now;
  
  // Convert numbers to strings for consistency
  const entryIdStr = String(entryId);
  
  if (action === 'add') {
    if (!processingEntries.includes(entryIdStr)) {
      processingEntries = [...processingEntries, entryIdStr];
      console.log(`[ProcessingState] Added ${entryIdStr} to processing entries`);
    }
  } else if (action === 'remove') {
    processingEntries = processingEntries.filter(id => id !== entryIdStr);
    console.log(`[ProcessingState] Removed ${entryIdStr} from processing entries`);
  } else if (action === 'complete' && !isNaN(Number(entryIdStr))) {
    // Mark as both removed from processing and added to completed
    processingEntries = processingEntries.filter(id => id !== entryIdStr);
    processedEntryIds = [...processedEntryIds, Number(entryIdStr)].slice(-100); // Keep last 100
    console.log(`[ProcessingState] Completed entry ${entryIdStr}`);
  }
  
  // Dispatch event if enough time has passed since last dispatch
  if (now - lastDispatchTime >= MIN_DISPATCH_INTERVAL) {
    dispatchProcessingUpdate();
    lastDispatchTime = now;
  } else {
    // Schedule a dispatch for later if we're throttling
    setTimeout(() => {
      // Only dispatch if there hasn't been a more recent dispatch
      if (lastDispatchTime < now) {
        dispatchProcessingUpdate();
        lastDispatchTime = Date.now();
      }
    }, MIN_DISPATCH_INTERVAL);
  }
}

// Get current state
export function getProcessingState(): {
  entries: string[];
  processedIds: number[];
  lastUpdate: number;
} {
  return {
    entries: [...processingEntries],
    processedIds: [...processedEntryIds],
    lastUpdate
  };
}

// Clear all processing entries
export function clearProcessingEntries(): void {
  processingEntries = [];
  lastUpdate = Date.now();
  dispatchProcessingUpdate(true);
}

// Dispatch event to notify listeners of state change
export function dispatchProcessingUpdate(forceUpdate = false): void {
  try {
    window.dispatchEvent(
      new CustomEvent('processingEntriesChanged', {
        detail: {
          entries: [...processingEntries],
          processedIds: [...processedEntryIds],
          lastUpdate,
          forceUpdate
        }
      })
    );
  } catch (error) {
    console.error('[ProcessingState] Error dispatching update:', error);
  }
}

// Dispatch event to notify listeners that an entry was mapped to an ID
export function dispatchEntryMapped(tempId: string, entryId: number): void {
  try {
    window.dispatchEvent(
      new CustomEvent('processingEntryMapped', {
        detail: {
          tempId,
          entryId,
          timestamp: Date.now()
        }
      })
    );
    
    // Also update the processing state
    updateProcessingEntries(tempId, 'remove');
  } catch (error) {
    console.error('[ProcessingState] Error dispatching entry mapped event:', error);
  }
}

// Dispatch event to notify listeners that an entry was completed
export function dispatchEntryCompleted(tempId: string, entryId: number): void {
  try {
    window.dispatchEvent(
      new CustomEvent('processingEntryCompleted', {
        detail: {
          tempId,
          entryId,
          timestamp: Date.now()
        }
      })
    );
    
    // Also update the processing state
    updateProcessingEntries(entryId, 'complete');
  } catch (error) {
    console.error('[ProcessingState] Error dispatching entry completed event:', error);
  }
}

// Setup listeners for tracking processing state
export function setupProcessingListeners(
  onUpdate?: (state: ReturnType<typeof getProcessingState>) => void
): () => void {
  const handleProcessingChange = (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail) {
      // Don't update our state based on our own events unless forced
      if (
        customEvent.detail.forceUpdate !== true &&
        customEvent.detail.lastUpdate <= lastUpdate
      ) {
        return;
      }

      // Update our state based on the event detail
      processingEntries = [...(customEvent.detail.entries || [])];
      if (customEvent.detail.processedIds) {
        processedEntryIds = [...customEvent.detail.processedIds];
      }
      lastUpdate = customEvent.detail.lastUpdate || Date.now();

      // Notify callback if provided
      if (onUpdate) {
        onUpdate(getProcessingState());
      }
    }
  };

  window.addEventListener('processingEntriesChanged', handleProcessingChange);

  // Return cleanup function
  return () => {
    window.removeEventListener('processingEntriesChanged', handleProcessingChange);
  };
}
