
export function setProcessingLock(isLocked: boolean): void {
  console.log(`[ProcessingState] Setting processing lock to ${isLocked}`);
  localStorage.setItem('isProcessingLocked', isLocked ? 'true' : 'false');
}

export function isProcessingLocked(): boolean {
  return localStorage.getItem('isProcessingLocked') === 'true';
}

export function resetProcessingState(): void {
  console.log('[ProcessingState] Resetting processing state');
  localStorage.removeItem('isProcessingLocked');
  localStorage.removeItem('isEntryBeingProcessed');
  // Don't clear processingEntries here, they should be handled separately
}

export function setIsEntryBeingProcessed(isBeingProcessed: boolean): void {
  localStorage.setItem('isEntryBeingProcessed', isBeingProcessed ? 'true' : 'false');
}

export function isEntryBeingProcessed(): boolean {
  return localStorage.getItem('isEntryBeingProcessed') === 'true';
}

export function updateProcessingEntries(tempId: string, action: 'add' | 'remove'): void {
  const entriesStr = localStorage.getItem('processingEntries') || '[]';
  let entries: string[] = [];
  
  try {
    entries = JSON.parse(entriesStr);
    if (!Array.isArray(entries)) {
      entries = [];
    }
  } catch (e) {
    console.error('Error parsing processing entries:', e);
    entries = [];
  }
  
  if (action === 'add' && !entries.includes(tempId)) {
    entries.push(tempId);
  } else if (action === 'remove') {
    entries = entries.filter(id => id !== tempId);
  }
  
  localStorage.setItem('processingEntries', JSON.stringify(entries));
  
  // Dispatch custom event for components to listen to
  const event = new CustomEvent('processingEntriesChanged', {
    detail: {
      entries,
      lastUpdate: Date.now()
    }
  });
  
  window.dispatchEvent(event);
  console.log(`[ProcessingState] Updated entries (${action}): ${JSON.stringify(entries)}`);
}

export function getProcessingEntries(): string[] {
  const entriesStr = localStorage.getItem('processingEntries') || '[]';
  try {
    const entries = JSON.parse(entriesStr);
    return Array.isArray(entries) ? entries : [];
  } catch (e) {
    console.error('Error parsing processing entries:', e);
    return [];
  }
}

export function isProcessingEntry(entryId: number | string): boolean {
  const entries = getProcessingEntries();
  const idStr = String(entryId);
  return entries.some(tempId => tempId.includes(idStr));
}

export function removeProcessingEntryById(entryId: number | string): void {
  const entries = getProcessingEntries();
  const idStr = String(entryId);
  const filteredEntries = entries.filter(tempId => !tempId.includes(idStr));
  
  if (filteredEntries.length !== entries.length) {
    localStorage.setItem('processingEntries', JSON.stringify(filteredEntries));
    
    window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
      detail: {
        entries: filteredEntries,
        lastUpdate: Date.now()
      }
    }));
    
    console.log(`[ProcessingState] Removed entry ID ${idStr} from processing entries`);
  }
}

// Add this function to handle previous entries flag
export function setHasPreviousEntries(hasEntries: boolean): void {
  localStorage.setItem('hasPreviousEntries', hasEntries ? 'true' : 'false');
}

export function getHasPreviousEntries(): boolean {
  return localStorage.getItem('hasPreviousEntries') === 'true';
}
