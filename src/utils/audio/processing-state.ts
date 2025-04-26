
/**
 * Audio processing state management
 * Handles processing locks and operational state
 */

// Flag to track if an entry is being processed to prevent duplicate notifications
let isEntryBeingProcessed = false;
let processingLock = false;
let processingTimeoutId: NodeJS.Timeout | null = null;
let lastStateChangeTime = 0;
const DEBOUNCE_THRESHOLD = 30; // Reduced from 50ms to 30ms to be more responsive

// Store mapping between processing IDs and entry IDs to help with cleanup
const processingToEntryMap = new Map<string, number>();
// Track components that should be removed
const componentsToRemove = new Set<string>();

// Store processing entries in localStorage to persist across navigations
export const updateProcessingEntries = (tempId: string, action: 'add' | 'remove') => {
  try {
    // Prevent rapid toggling by implementing a simple debounce
    const now = Date.now();
    if (now - lastStateChangeTime < DEBOUNCE_THRESHOLD) {
      console.log('[Audio.ProcessingState] Debouncing rapid state change');
      return getProcessingEntries(); // Return current state without changes
    }
    lastStateChangeTime = now;
    
    const storedEntries = localStorage.getItem('processingEntries');
    let entries: string[] = storedEntries ? JSON.parse(storedEntries) : [];
    
    if (action === 'add' && !entries.includes(tempId)) {
      entries.push(tempId);
      console.log(`[Audio.ProcessingState] Added entry ${tempId} to processing list. Now tracking ${entries.length} entries.`);
    } else if (action === 'remove') {
      entries = entries.filter(id => id !== tempId);
      console.log(`[Audio.ProcessingState] Removed entry ${tempId} from processing list. Now tracking ${entries.length} entries.`);
      
      // Add explicit cleanup here to ensure completed entries are properly marked
      window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
        detail: { tempId, timestamp: now, forceClearProcessingCard: true }
      }));
      
      // Also send an immediate follow-up event to ensure processing card is removed
      window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
        detail: { tempId, timestamp: now, forceCleanup: true }
      }));
      
      // Dispatch a third event to force update any UI that depends on this state
      window.dispatchEvent(new CustomEvent('processingStateChanged', {
        detail: { tempId, action: 'remove', timestamp: now }
      }));
    }
    
    localStorage.setItem('processingEntries', JSON.stringify(entries));
    
    // Dispatch an event so other components can react to the change immediately
    window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
      detail: { entries, lastUpdate: now, forceUpdate: true }
    }));
    
    // Send a second event with shorter delay to ensure all devices catch it
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
        detail: { entries, lastUpdate: now + 1, forceUpdate: true }
      }));
    }, 10); // Reduced from 20ms to 10ms
    
    return entries;
  } catch (error) {
    console.error('[Audio.ProcessingState] Error updating processing entries in storage:', error);
    
    // Safety cleanup - make sure we don't leave processing locks in place
    setProcessingLock(false);
    setIsEntryBeingProcessed(false);
    
    return [];
  }
};

// Get the current processing entries from localStorage
export const getProcessingEntries = (): string[] => {
  try {
    const storedEntries = localStorage.getItem('processingEntries');
    let entries = storedEntries ? JSON.parse(storedEntries) : [];
    
    console.log(`[Audio.ProcessingState] Retrieved ${entries.length} processing entries from storage.`);
    return entries;
  } catch (error) {
    console.error('[Audio.ProcessingState] Error retrieving processing entries from storage:', error);
    return [];
  }
};

// Remove processing entry by ID (useful when an entry is completed)
export const removeProcessingEntryById = (entryId: number | string): void => {
  try {
    // Prevent rapid toggling with debounce
    const now = Date.now();
    if (now - lastStateChangeTime < DEBOUNCE_THRESHOLD) {
      console.log('[Audio.ProcessingState] Debouncing rapid removal request');
      return;
    }
    lastStateChangeTime = now;
    
    const idStr = String(entryId);
    const storedEntries = localStorage.getItem('processingEntries');
    let entries: string[] = storedEntries ? JSON.parse(storedEntries) : [];
    
    // Find both exact matches and any that include the ID as part of a composite ID
    const updatedEntries = entries.filter(tempId => {
      return tempId !== idStr && !tempId.includes(idStr);
    });
    
    // Look up any entry ID that might be mapped from a processing ID
    let mappedEntryId: number | undefined;
    
    // If we're removing a processing ID, see if it's mapped to a real entry ID
    if (typeof entryId === 'string') {
      // Check our local map first
      mappedEntryId = processingToEntryMap.get(entryId);
      
      // If not found in local map, check localStorage
      if (!mappedEntryId) {
        try {
          const mappingStr = localStorage.getItem('processingToEntryMap');
          if (mappingStr) {
            const mappings = JSON.parse(mappingStr);
            mappedEntryId = mappings[entryId];
          }
        } catch (e) {
          console.error('[Audio.ProcessingState] Error checking mapping storage:', e);
        }
      }
    }
    
    if (updatedEntries.length !== entries.length) {
      localStorage.setItem('processingEntries', JSON.stringify(updatedEntries));
      
      // Fire these events synchronously so they happen immediately
      window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
        detail: { 
          tempId: idStr, 
          entryId: mappedEntryId, 
          timestamp: now, 
          forceClearProcessingCard: true 
        }
      }));
      
      // Immediately send an event to force removal of processing cards
      window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
        detail: { 
          tempId: idStr, 
          entryId: mappedEntryId,
          timestamp: now,
          forceCleanup: true
        }
      }));
      
      // Also send a general state change event
      window.dispatchEvent(new CustomEvent('processingStateChanged', {
        detail: { 
          tempId: idStr, 
          entryId: mappedEntryId,
          action: 'remove', 
          timestamp: now 
        }
      }));
      
      // Dispatch an event so other components can react to the change
      window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
        detail: { 
          entries: updatedEntries, 
          lastUpdate: now, 
          removedId: idStr, 
          entryId: mappedEntryId,
          forceUpdate: true 
        }
      }));
      
      console.log(`[Audio.ProcessingState] Removed processing entry with ID ${idStr}`);
    }
    
    // Safety cleanup - if we're removing the last processing entry, make sure locks are cleared
    if (updatedEntries.length === 0) {
      setProcessingLock(false);
      setIsEntryBeingProcessed(false);
      
      // Also clean any mapping data
      clearProcessingMappings();
    }
  } catch (error) {
    console.error('[Audio.ProcessingState] Error removing processing entry from storage:', error);
    // Safety cleanup
    setProcessingLock(false);
    setIsEntryBeingProcessed(false);
  }
};

// Store a mapping between a processing ID and an entry ID
export const setProcessingToEntryMapping = (processingId: string, entryId: number): void => {
  try {
    processingToEntryMap.set(processingId, entryId);
    
    // Also store in localStorage for persistence
    const mappingStr = localStorage.getItem('processingToEntryMap');
    const mappings = mappingStr ? JSON.parse(mappingStr) : {};
    mappings[processingId] = entryId;
    localStorage.setItem('processingToEntryMap', JSON.stringify(mappings));
    
    // Dispatch an event to notify components about the mapping
    window.dispatchEvent(new CustomEvent('processingEntryMapped', {
      detail: { 
        tempId: processingId, 
        entryId: entryId,
        timestamp: Date.now() 
      }
    }));
    
    // Also trigger removal of the processing card
    setTimeout(() => {
      removeProcessingEntryById(processingId);
    }, 100);
  } catch (error) {
    console.error('[Audio.ProcessingState] Error setting processing to entry mapping:', error);
  }
};

// Get an entry ID from a processing ID
export const getEntryIdFromProcessingId = (processingId: string): number | undefined => {
  // Check the local map first
  const mappedId = processingToEntryMap.get(processingId);
  if (mappedId !== undefined) return mappedId;
  
  // Then check localStorage
  try {
    const mappingStr = localStorage.getItem('processingToEntryMap');
    if (!mappingStr) return undefined;
    
    const mappings = JSON.parse(mappingStr);
    return mappings[processingId];
  } catch (error) {
    console.error('[Audio.ProcessingState] Error getting entry ID from processing ID:', error);
    return undefined;
  }
};

// Clear all processing to entry mappings
export const clearProcessingMappings = (): void => {
  processingToEntryMap.clear();
  localStorage.removeItem('processingToEntryMap');
};

// Track a component that should be removed
export const markComponentForRemoval = (componentId: string): void => {
  componentsToRemove.add(componentId);
  
  // Dispatch an event to notify components
  window.dispatchEvent(new CustomEvent('componentMarkedForRemoval', {
    detail: { componentId, timestamp: Date.now() }
  }));
};

// Check if a component should be removed
export const shouldRemoveComponent = (componentId: string): boolean => {
  return componentsToRemove.has(componentId);
};

// Clear component removal markers
export const clearComponentRemovalMarkers = (): void => {
  componentsToRemove.clear();
};

// Check if a journal entry is currently being processed
export function isProcessingEntry(): boolean {
  return isEntryBeingProcessed;
}

// Release all locks and reset processing state (useful for recovery)
export function resetProcessingState(): void {
  console.log('[Audio.ProcessingState] Manually resetting processing state');
  isEntryBeingProcessed = false;
  processingLock = false;
  
  // Clear all processing entries from localStorage
  localStorage.setItem('processingEntries', JSON.stringify([]));
  
  // Clear all mappings
  clearProcessingMappings();
  
  // Clear all component removal markers
  clearComponentRemovalMarkers();
  
  if (processingTimeoutId) {
    clearTimeout(processingTimeoutId);
    processingTimeoutId = null;
  }
  
  // Clear all toasts to ensure UI is clean
  import('@/services/notificationService').then(({ clearAllToasts }) => {
    clearAllToasts();
  });
  
  // Dispatch a reset event
  window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
    detail: { entries: [], reset: true, lastUpdate: Date.now(), forceUpdate: true }
  }));
  
  // Forcefully remove all processing cards
  window.dispatchEvent(new CustomEvent('forceRemoveAllProcessingCards', {
    detail: { timestamp: Date.now() }
  }));
  
  // Also dispatch a completion event for all entries
  window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
    detail: { tempId: 'all', timestamp: Date.now(), forceClearProcessingCard: true }
  }));
}

// Internal setters used by the main processing module
export function setProcessingLock(value: boolean): void {
  processingLock = value;
}

export function getProcessingLock(): boolean {
  return processingLock;
}

export function setProcessingTimeoutId(id: NodeJS.Timeout | null): void {
  processingTimeoutId = id;
}

export function getProcessingTimeoutId(): NodeJS.Timeout | null {
  return processingTimeoutId;
}

export function setIsEntryBeingProcessed(value: boolean): void {
  isEntryBeingProcessed = value;
}

// Variable to check if user has previous entries
export let hasPreviousEntries = false;
export function setHasPreviousEntries(value: boolean): void {
  hasPreviousEntries = value;
}
