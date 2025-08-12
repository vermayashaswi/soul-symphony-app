/**
 * Audio processing state management
 * Handles processing locks and operational state
 */

// Flag to track if an entry is being processed to prevent duplicate notifications
let isEntryBeingProcessed = false;
let processingLock = false;
let processingTimeoutId: NodeJS.Timeout | null = null;
let lastStateChangeTime = 0;
const DEBOUNCE_THRESHOLD = 10; // Reduced from 20ms to 10ms for faster response
const STALE_ENTRY_THRESHOLD = 1 * 60 * 1000; // Reduced from 3 minutes to 1 minute

// Store mapping between processing IDs and entry IDs to help with cleanup
const processingToEntryMap = new Map<string, number>();
// Track components that should be removed
const componentsToRemove = new Set<string>();
// Track when entries were added to processing
const processingEntryTimestamps = new Map<string, number>();
// Track entries that are completed
const completedEntries = new Set<string>();

// Simple caching mechanism to prevent redundant operations
const recentOperations = new Map<string, number>();

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
    
    // Generate cache key for this operation
    const operationKey = `${action}-${tempId}-${now}`;
    if (recentOperations.has(operationKey)) {
      console.log('[Audio.ProcessingState] Skipping duplicate recent operation');
      return getProcessingEntries();
    }
    // Add to recent operations with auto-expiry
    recentOperations.set(operationKey, now);
    setTimeout(() => recentOperations.delete(operationKey), 2000); // Reduced from 5s to 2s
    
    const storedEntries = localStorage.getItem('processingEntries');
    let entries: string[] = storedEntries ? JSON.parse(storedEntries) : [];
    
    if (action === 'add' && !entries.includes(tempId)) {
      entries.push(tempId);
      processingEntryTimestamps.set(tempId, now);
      completedEntries.delete(tempId); // If it's being added, it's clearly not completed
      console.log(`[Audio.ProcessingState] Added entry ${tempId} to processing list. Now tracking ${entries.length} entries.`);
    } else if (action === 'remove') {
      entries = entries.filter(id => id !== tempId);
      processingEntryTimestamps.delete(tempId);
      completedEntries.add(tempId); // Mark as completed when explicitly removed
      
      console.log(`[Audio.ProcessingState] Removed entry ${tempId} from processing list. Now tracking ${entries.length} entries.`);
      
      // IMMEDIATE cleanup - no delays
      window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
        detail: { tempId, timestamp: now, forceClearProcessingCard: true, immediate: true }
      }));
      
      window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
        detail: { tempId, timestamp: now, forceCleanup: true, immediate: true }
      }));
      
      window.dispatchEvent(new CustomEvent('forceRemoveLoadingContent', {
        detail: { tempId, timestamp: now, immediate: true }
      }));
      
      window.dispatchEvent(new CustomEvent('processingStateChanged', {
        detail: { tempId, action: 'remove', timestamp: now, immediate: true }
      }));
      
      // Removed immediate DOM cleanup; rely on React components to unmount on events
    }
    
    localStorage.setItem('processingEntries', JSON.stringify(entries));
    
    // Dispatch events IMMEDIATELY - no delays
    window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
      detail: { entries, lastUpdate: now, forceUpdate: true, immediate: true }
    }));
    
    // Send a second event immediately to ensure all devices catch it
    window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
      detail: { entries, lastUpdate: now + 1, forceUpdate: true, immediate: true }
    }));
    
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
    
    // Clean up stale entries automatically (older than 1 minute)
    const now = Date.now();
    const validEntries = entries.filter(id => {
      // Skip if it's marked as completed
      if (completedEntries.has(id)) return false;
      
      // Get timestamp, either from our runtime memory or parse from ID format
      let timestamp = processingEntryTimestamps.get(id);
      if (!timestamp) {
        // Try to extract timestamp from ID format (if it uses timestamp in the ID)
        const parts = id.split('-');
        const possibleTimestamp = parseInt(parts[parts.length - 1]);
        if (!isNaN(possibleTimestamp)) {
          timestamp = possibleTimestamp;
          processingEntryTimestamps.set(id, possibleTimestamp);
        } else {
          // If we can't determine age, assume it's recent
          processingEntryTimestamps.set(id, now);
          return true;
        }
      }
      
      // Check if entry is stale
      const isStale = (now - timestamp) > STALE_ENTRY_THRESHOLD;
      if (isStale) {
        console.log(`[Audio.ProcessingState] Found stale entry: ${id}, removing automatically`);
        // Fire events IMMEDIATELY to ensure stale processing card is removed
        window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
          detail: { tempId: id, timestamp: now, forceClearProcessingCard: true, wasStale: true, immediate: true }
        }));
        
        window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
          detail: { tempId: id, timestamp: now, forceCleanup: true, wasStale: true, immediate: true }
        }));
        
        // Removed immediate DOM cleanup for stale cards; components will unmount via state/events
        
        return false; // Remove this stale entry
      }
      
      return true; // Keep valid entry
    });
    
    // If we removed stale entries, update storage IMMEDIATELY
    if (validEntries.length !== entries.length) {
      localStorage.setItem('processingEntries', JSON.stringify(validEntries));
      console.log(`[Audio.ProcessingState] Removed ${entries.length - validEntries.length} stale entries`);
      
      // Notify about the change IMMEDIATELY
      window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
        detail: { entries: validEntries, lastUpdate: now, forceUpdate: true, immediate: true }
      }));
      
      entries = validEntries;
    }
    
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
    
    // Skip if we've already processed this recently
    const operationKey = `remove-${idStr}-${Math.floor(now/500)}`; // Group by 500ms instead of 1s
    if (recentOperations.has(operationKey)) {
      console.log('[Audio.ProcessingState] Skipping duplicate removal, already processed recently');
      return;
    }
    recentOperations.set(operationKey, now);
    setTimeout(() => recentOperations.delete(operationKey), 2000); // Reduced from 5s to 2s
    
    const storedEntries = localStorage.getItem('processingEntries');
    let entries: string[] = storedEntries ? JSON.parse(storedEntries) : [];
    
    // Find both exact matches and any that include the ID as part of a composite ID
    const updatedEntries = entries.filter(tempId => {
      const shouldKeep = tempId !== idStr && !tempId.includes(idStr);
      if (!shouldKeep) {
        completedEntries.add(tempId);
      }
      return shouldKeep;
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
      
      // Fire these events IMMEDIATELY - no delays
      window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
        detail: { 
          tempId: idStr, 
          entryId: mappedEntryId, 
          timestamp: now, 
          forceClearProcessingCard: true,
          immediate: true
        }
      }));
      
      window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
        detail: { 
          tempId: idStr, 
          entryId: mappedEntryId,
          timestamp: now,
          forceCleanup: true,
          immediate: true
        }
      }));
      
      window.dispatchEvent(new CustomEvent('forceRemoveLoadingContent', {
        detail: { tempId: idStr, entryId: mappedEntryId, immediate: true }
      }));
      
      window.dispatchEvent(new CustomEvent('processingStateChanged', {
        detail: { 
          tempId: idStr, 
          entryId: mappedEntryId,
          action: 'remove', 
          timestamp: now,
          immediate: true
        }
      }));
      
      window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
        detail: { 
          entries: updatedEntries, 
          lastUpdate: now, 
          removedId: idStr, 
          entryId: mappedEntryId,
          forceUpdate: true,
          immediate: true
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

// Check if a processing entry is completed
export const isProcessingEntryCompleted = (processingId: string): boolean => {
  return completedEntries.has(processingId);
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
    
    // Mark as completed
    completedEntries.add(processingId);
    
    // Dispatch an event to notify components about the mapping
    window.dispatchEvent(new CustomEvent('processingEntryMapped', {
      detail: { 
        tempId: processingId, 
        entryId: entryId,
        timestamp: Date.now() 
      }
    }));
    
    // Also force removal of any processing cards
    window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
      detail: { 
        tempId: processingId,
        entryId: entryId,
        timestamp: Date.now(),
        forceCleanup: true
      }
    }));
    
    // Force remove any loading components
    window.dispatchEvent(new CustomEvent('forceRemoveLoadingContent', {
      detail: { tempId: processingId, entryId: entryId }
    }));
    
    // Also trigger removal of the processing entry
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
  
  // Clear all completed entries
  completedEntries.clear();
  
  // Clear all timestamps
  processingEntryTimestamps.clear();
  
  if (processingTimeoutId) {
    clearTimeout(processingTimeoutId);
    processingTimeoutId = null;
  }
  
  // Clear all toasts to ensure UI is clean
  import('@/services/notificationService').then(({ clearAllToasts }) => {
    clearAllToasts();
  }).catch(error => {
    console.error('[Audio.ProcessingState] Error importing notificationService:', error);
  });
  
  // Dispatch a reset event
  window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
    detail: { entries: [], reset: true, lastUpdate: Date.now(), forceUpdate: true }
  }));
  
  // Forcefully remove all processing cards via events; React will handle unmounts
  window.dispatchEvent(new CustomEvent('forceRemoveAllProcessingCards', {
    detail: { timestamp: Date.now() }
  }));
  
  // Also notify that all loading components should be removed via events; React will handle unmounts
  window.dispatchEvent(new CustomEvent('forceRemoveAllLoadingContent', {
    detail: { timestamp: Date.now() }
  }));
  
  // Also dispatch a completion event for all entries
  window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
    detail: { tempId: 'all', timestamp: Date.now(), forceClearProcessingCard: true }
  }));
};

// Utility function to get deleted entry IDs
export const getDeletedEntryIds = (): { processingIds: string[], entryIds: number[] } => {
  try {
    const deletedStr = localStorage.getItem('deletedEntryIds');
    const deletedProcessingStr = localStorage.getItem('deletedProcessingIds');
    
    const deletedEntryIds = deletedStr ? JSON.parse(deletedStr) : [];
    const deletedProcessingIds = deletedProcessingStr ? JSON.parse(deletedProcessingStr) : [];
    
    return { 
      processingIds: deletedProcessingIds, 
      entryIds: deletedEntryIds 
    };
  } catch (error) {
    console.error('[Audio.ProcessingState] Error getting deleted entry IDs:', error);
    return { processingIds: [], entryIds: [] };
  }
};

// Utility function to check if an entry is deleted
export const isEntryDeleted = (entryId: number | string): boolean => {
  try {
    const { processingIds, entryIds } = getDeletedEntryIds();
    
    if (typeof entryId === 'number') {
      return entryIds.includes(entryId);
    } else {
      return processingIds.includes(entryId);
    }
  } catch (error) {
    console.error('[Audio.ProcessingState] Error checking if entry is deleted:', error);
    return false;
  }
};

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
