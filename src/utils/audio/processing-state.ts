
/**
 * Manages the state of audio processing entries
 * Using localStorage to persist across page navigation and refreshes
 */

const PROCESSING_LOCK_KEY = 'audioProcessingLock';
const ENTRY_PROCESSING_KEY = 'isEntryBeingProcessed';
const PROCESSING_ENTRIES_KEY = 'processingEntries';

/**
 * Sets the global processing lock
 */
export function setProcessingLock(isLocked: boolean): void {
  if (isLocked) {
    localStorage.setItem(PROCESSING_LOCK_KEY, 'true');
  } else {
    localStorage.removeItem(PROCESSING_LOCK_KEY);
  }
}

/**
 * Checks if processing is locked
 */
export function isProcessingLocked(): boolean {
  return localStorage.getItem(PROCESSING_LOCK_KEY) === 'true';
}

/**
 * Sets the entry processing state
 */
export function setIsEntryBeingProcessed(isProcessing: boolean): void {
  if (isProcessing) {
    localStorage.setItem(ENTRY_PROCESSING_KEY, 'true');
  } else {
    localStorage.removeItem(ENTRY_PROCESSING_KEY);
  }
}

/**
 * Checks if an entry is being processed
 */
export function isProcessingEntry(): boolean {
  return localStorage.getItem(ENTRY_PROCESSING_KEY) === 'true';
}

/**
 * Updates the processing entries list
 * @param entryId The ID of the entry being processed
 * @param action 'add' or 'remove'
 */
export function updateProcessingEntries(entryId: string, action: 'add' | 'remove'): void {
  const currentEntriesStr = localStorage.getItem(PROCESSING_ENTRIES_KEY);
  let currentEntries: string[] = [];
  
  try {
    if (currentEntriesStr) {
      currentEntries = JSON.parse(currentEntriesStr);
      if (!Array.isArray(currentEntries)) {
        currentEntries = [];
      }
    }
  } catch (error) {
    console.error('Error parsing processing entries:', error);
    currentEntries = [];
  }
  
  if (action === 'add' && !currentEntries.includes(entryId)) {
    currentEntries.push(entryId);
  } else if (action === 'remove') {
    currentEntries = currentEntries.filter(id => id !== entryId);
  }
  
  localStorage.setItem(PROCESSING_ENTRIES_KEY, JSON.stringify(currentEntries));
  
  // Dispatch event for any listeners
  window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
    detail: { entries: currentEntries, lastUpdate: Date.now() }
  }));
}

/**
 * Gets the list of processing entries
 */
export function getProcessingEntries(): string[] {
  const entriesStr = localStorage.getItem(PROCESSING_ENTRIES_KEY);
  if (!entriesStr) return [];
  
  try {
    const entries = JSON.parse(entriesStr);
    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    console.error('Error parsing processing entries:', error);
    return [];
  }
}

/**
 * Removes a specific entry from processing entries by ID
 */
export function removeProcessingEntryById(entryId: number): void {
  const entryIdStr = String(entryId);
  const currentEntries = getProcessingEntries();
  
  const updatedEntries = currentEntries.filter(id => !id.includes(entryIdStr));
  
  if (updatedEntries.length !== currentEntries.length) {
    localStorage.setItem(PROCESSING_ENTRIES_KEY, JSON.stringify(updatedEntries));
    
    // Dispatch event for any listeners
    window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
      detail: { entries: updatedEntries, lastUpdate: Date.now() }
    }));
  }
}

/**
 * Resets all processing state
 */
export function resetProcessingState(): void {
  localStorage.removeItem(PROCESSING_LOCK_KEY);
  localStorage.removeItem(ENTRY_PROCESSING_KEY);
  localStorage.removeItem(PROCESSING_ENTRIES_KEY);
  
  // Dispatch event to notify listeners
  window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
    detail: { entries: [], lastUpdate: Date.now() }
  }));
}

