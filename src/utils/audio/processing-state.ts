
/**
 * Audio processing state management
 * Handles processing locks and operational state
 */

// Flag to track if an entry is being processed to prevent duplicate notifications
let isEntryBeingProcessed = false;
let processingLock = false;
let processingTimeoutId: NodeJS.Timeout | null = null;
let lastStateChangeTime = 0;
const DEBOUNCE_THRESHOLD = 1000; // Increased from 500ms to 1000ms to prevent rapid state changes

// Store all deleted entries to prevent them from showing up again if user navigates away and back
const deletedProcessingTempIds = new Set<string>();

// Store processing entries in localStorage to persist across navigations
export const updateProcessingEntries = (tempId: string, action: 'add' | 'remove') => {
  try {
    // Skip any operations for deleted temp IDs
    if (deletedProcessingTempIds.has(tempId)) {
      console.log(`[Audio.ProcessingState] Skipping operation for deleted tempId: ${tempId}`);
      return getProcessingEntries(); // Return current state without changes
    }
    
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
      // Add timestamp to tempId to track staleness
      const tempIdWithTimestamp = `${tempId}-${Date.now()}`;
      entries.push(tempIdWithTimestamp);
      console.log(`[Audio.ProcessingState] Added entry ${tempIdWithTimestamp} to processing list. Now tracking ${entries.length} entries.`);
    } else if (action === 'remove') {
      entries = entries.filter(id => !id.startsWith(tempId));
      // Mark as deleted so it won't show up again
      deletedProcessingTempIds.add(tempId);
      console.log(`[Audio.ProcessingState] Removed entry ${tempId} from processing list. Now tracking ${entries.length} entries.`);
    }
    
    localStorage.setItem('processingEntries', JSON.stringify(entries));
    
    // Dispatch an event so other components can react to the change
    // Ensure we set forceUpdate flag to true to guarantee the UI updates
    window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
      detail: { entries, lastUpdate: now, forceUpdate: true }
    }));
    
    return entries;
  } catch (error) {
    console.error('[Audio.ProcessingState] Error updating processing entries in storage:', error);
    return [];
  }
};

// Get the current processing entries from localStorage
export const getProcessingEntries = (): string[] => {
  try {
    const storedEntries = localStorage.getItem('processingEntries');
    let entries = storedEntries ? JSON.parse(storedEntries) : [];
    
    // Filter out stale entries (older than 10 minutes) and deleted entries
    if (entries.length > 0) {
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      entries = entries.filter((entry: string) => {
        // Skip deleted entries
        if (deletedProcessingTempIds.has(entry.split('-')[0])) {
          return false;
        }
        
        // Check if entry has timestamp (entries added after this update)
        const parts = entry.split('-');
        if (parts.length > 1) {
          const timestamp = parseInt(parts[parts.length - 1]);
          return !isNaN(timestamp) && timestamp > tenMinutesAgo;
        }
        // For legacy entries without timestamps, keep them
        return true;
      });
      
      // Update storage with filtered entries
      localStorage.setItem('processingEntries', JSON.stringify(entries));
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
    const storedEntries = localStorage.getItem('processingEntries');
    let entries: string[] = storedEntries ? JSON.parse(storedEntries) : [];
    
    // Enhanced filtering to catch more variations of tempId
    const updatedEntries = entries.filter(tempId => {
      // Get the base tempId without timestamp
      const baseTempId = tempId.split('-')[0];
      
      // Check if this tempId contains the entryId we want to remove
      const hasId = tempId.includes(idStr);
      
      // Mark as deleted if it matches
      if (hasId || baseTempId === idStr) {
        deletedProcessingTempIds.add(baseTempId);
        return false;
      }
      
      // Also check if this tempId is mapped to the entryId in processingToEntryMap
      let isMapped = false;
      try {
        const mapStr = localStorage.getItem('processingToEntryMap');
        if (mapStr) {
          const map = JSON.parse(mapStr);
          isMapped = String(map[baseTempId]) === idStr;
          
          if (isMapped) {
            deletedProcessingTempIds.add(baseTempId);
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
      
      return !hasId && !isMapped;
    });
    
    if (updatedEntries.length !== entries.length) {
      localStorage.setItem('processingEntries', JSON.stringify(updatedEntries));
      
      // Dispatch an event so other components can react to the change
      window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
        detail: { entries: updatedEntries, lastUpdate: now, removedId: idStr, forceUpdate: true }
      }));
      
      console.log(`[Audio.ProcessingState] Removed processing entry with ID ${idStr}`);
    }
  } catch (error) {
    console.error('[Audio.ProcessingState] Error removing processing entry from storage:', error);
  }
};

// Check if an entry ID has been marked as deleted
export const isEntryDeleted = (tempId: string): boolean => {
  const baseTempId = tempId.split('-')[0];
  return deletedProcessingTempIds.has(baseTempId);
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
