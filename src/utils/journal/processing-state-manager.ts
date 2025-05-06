import { Subject } from 'rxjs';

export enum EntryProcessingState {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export interface ProcessingEntry {
  tempId: string;
  startTime: number;
  entryId?: number;
  state: EntryProcessingState;
  errorMessage?: string;
  lastUpdate: number;
}

class ProcessingStateManager {
  private entries: ProcessingEntry[] = [];
  private entriesSubject = new Subject<ProcessingEntry[]>();
  private localStorageKey = 'journal_processing_entries';
  
  constructor() {
    this.restoreFromLocalStorage();
    
    // Add cleanup interval to prevent stale entries
    setInterval(() => this.cleanupStaleEntries(), 60000); // Run every minute
  }
  
  // Get all processing entries
  getProcessingEntries(): ProcessingEntry[] {
    return [...this.entries];
  }
  
  // Check if a specific tempId is being processed
  isProcessing(tempId: string): boolean {
    return this.entries.some(
      entry => entry.tempId === tempId && entry.state === EntryProcessingState.PROCESSING
    );
  }
  
  // Check if a specific tempId has an error
  hasError(tempId: string): boolean {
    return this.entries.some(
      entry => entry.tempId === tempId && entry.state === EntryProcessingState.ERROR
    );
  }
  
  // Get entryId for a tempId if it exists
  getEntryId(tempId: string): number | undefined {
    const entry = this.entries.find(entry => entry.tempId === tempId);
    return entry?.entryId;
  }
  
  // Start processing an entry
  startProcessing(tempId: string): void {
    // Check if entry already exists
    if (this.entries.some(entry => entry.tempId === tempId)) {
      // Just update the state
      this.updateEntryState(tempId, EntryProcessingState.PROCESSING);
      return;
    }
    
    const newEntry: ProcessingEntry = {
      tempId,
      startTime: Date.now(),
      state: EntryProcessingState.PROCESSING,
      lastUpdate: Date.now()
    };
    
    this.entries.push(newEntry);
    this.notifySubscribers();
    this.saveToLocalStorage();
    
    console.log(`[ProcessingStateManager] Started processing entry ${tempId}`);
  }
  
  // Set entryId for a tempId
  setEntryId(tempId: string, entryId: number): void {
    const entry = this.entries.find(entry => entry.tempId === tempId);
    
    if (entry) {
      entry.entryId = entryId;
      entry.lastUpdate = Date.now();
      this.notifySubscribers();
      this.saveToLocalStorage();
      
      console.log(`[ProcessingStateManager] Set entry ID ${entryId} for tempId ${tempId}`);
    } else {
      // Entry not found, create a new one
      this.entries.push({
        tempId,
        entryId,
        startTime: Date.now(),
        state: EntryProcessingState.COMPLETED,
        lastUpdate: Date.now()
      });
      
      this.notifySubscribers();
      this.saveToLocalStorage();
      
      console.log(`[ProcessingStateManager] Created new completed entry with ID ${entryId} for tempId ${tempId}`);
    }
  }
  
  // Update processing state for an entry
  updateEntryState(tempId: string, state: EntryProcessingState, errorMessage?: string): void {
    const entry = this.entries.find(entry => entry.tempId === tempId);
    
    if (entry) {
      entry.state = state;
      entry.lastUpdate = Date.now();
      
      if (errorMessage !== undefined) {
        entry.errorMessage = errorMessage;
      }
      
      this.notifySubscribers();
      this.saveToLocalStorage();
      
      console.log(`[ProcessingStateManager] Updated entry ${tempId} to state: ${state}`);
    } else {
      // Entry not found, create a new one with the given state
      this.entries.push({
        tempId,
        startTime: Date.now(),
        state,
        errorMessage,
        lastUpdate: Date.now()
      });
      
      this.notifySubscribers();
      this.saveToLocalStorage();
      
      console.log(`[ProcessingStateManager] Created new entry ${tempId} with state: ${state}`);
    }
  }
  
  // Remove an entry by tempId
  removeEntry(tempId: string): boolean {
    const initialLength = this.entries.length;
    this.entries = this.entries.filter(entry => entry.tempId !== tempId);
    
    if (initialLength !== this.entries.length) {
      this.notifySubscribers();
      this.saveToLocalStorage();
      
      console.log(`[ProcessingStateManager] Removed entry ${tempId}`);
      return true;
    }
    
    return false;
  }
  
  // Retry a failed entry
  retryProcessing(tempId: string): boolean {
    const entry = this.entries.find(entry => entry.tempId === tempId);
    
    if (entry && entry.state === EntryProcessingState.ERROR) {
      entry.state = EntryProcessingState.PROCESSING;
      entry.errorMessage = undefined;
      entry.lastUpdate = Date.now();
      
      this.notifySubscribers();
      this.saveToLocalStorage();
      
      console.log(`[ProcessingStateManager] Retrying entry ${tempId}`);
      return true;
    }
    
    return false;
  }
  
  // Clean up stale entries that haven't been updated in a while
  private cleanupStaleEntries(): void {
    const now = Date.now();
    const STALE_THRESHOLD = 60 * 60 * 1000; // 1 hour
    
    const initialLength = this.entries.length;
    this.entries = this.entries.filter(entry => {
      // Keep entries that have been updated recently
      return now - entry.lastUpdate < STALE_THRESHOLD;
    });
    
    if (initialLength !== this.entries.length) {
      console.log(`[ProcessingStateManager] Cleaned up ${initialLength - this.entries.length} stale entries`);
      this.notifySubscribers();
      this.saveToLocalStorage();
    }
  }
  
  // Save entries to localStorage
  saveToLocalStorage(): void {
    try {
      localStorage.setItem(this.localStorageKey, JSON.stringify(this.entries));
    } catch (error) {
      console.error('[ProcessingStateManager] Error saving to localStorage:', error);
    }
  }
  
  // Restore entries from localStorage
  restoreFromLocalStorage(): void {
    try {
      const savedEntries = localStorage.getItem(this.localStorageKey);
      
      if (savedEntries) {
        this.entries = JSON.parse(savedEntries);
        console.log(`[ProcessingStateManager] Restored ${this.entries.length} entries from localStorage`);
        
        // Clean up any potentially stale entries right away
        this.cleanupStaleEntries();
      }
    } catch (error) {
      console.error('[ProcessingStateManager] Error restoring from localStorage:', error);
    }
  }
  
  // Observable for entries changes
  entriesChanges() {
    return this.entriesSubject.asObservable();
  }
  
  // Notify subscribers of entries changes
  private notifySubscribers(): void {
    this.entriesSubject.next([...this.entries]);
  }
  
  // Clear all entries
  clearAll(): void {
    this.entries = [];
    this.notifySubscribers();
    this.saveToLocalStorage();
    console.log('[ProcessingStateManager] Cleared all entries');
  }
}

export const processingStateManager = new ProcessingStateManager();
