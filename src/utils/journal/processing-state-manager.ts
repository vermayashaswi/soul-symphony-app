
/**
 * Processing state manager for journal entries
 */
import { Subject } from 'rxjs';

export enum EntryProcessingState {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error',
  CANCELLED = 'cancelled'
}

export interface ProcessingEntry {
  tempId: string;
  entryId?: number;
  state: EntryProcessingState;
  timestamp: number;
  errorMessage?: string;
  isVisible: boolean;
}

class ProcessingStateManager {
  private entries = new Map<string, ProcessingEntry>();
  private entriesSubject = new Subject<ProcessingEntry[]>();
  
  startProcessing(tempId: string): void {
    console.log(`[ProcessingStateManager] Starting processing for ${tempId}`);
    
    const entry: ProcessingEntry = {
      tempId,
      state: EntryProcessingState.PROCESSING,
      timestamp: Date.now(),
      isVisible: true
    };
    
    this.entries.set(tempId, entry);
    this.notifyChange();
  }
  
  updateEntryState(tempId: string, state: EntryProcessingState, errorMessage?: string): void {
    console.log(`[ProcessingStateManager] Updating ${tempId} to state: ${state}`);
    
    const entry = this.entries.get(tempId);
    if (entry) {
      entry.state = state;
      entry.timestamp = Date.now();
      if (errorMessage) {
        entry.errorMessage = errorMessage;
      }
      this.notifyChange();
    }
  }
  
  setEntryId(tempId: string, entryId: number): void {
    console.log(`[ProcessingStateManager] Setting entryId ${entryId} for ${tempId}`);
    
    const entry = this.entries.get(tempId);
    if (entry) {
      entry.entryId = entryId;
      this.notifyChange();
    }
  }
  
  removeEntry(tempId: string): void {
    console.log(`[ProcessingStateManager] Removing entry ${tempId}`);
    
    if (this.entries.delete(tempId)) {
      this.notifyChange();
    }
  }
  
  retryProcessing(tempId: string): void {
    console.log(`[ProcessingStateManager] Retrying processing for ${tempId}`);
    
    const entry = this.entries.get(tempId);
    if (entry) {
      entry.state = EntryProcessingState.PROCESSING;
      entry.timestamp = Date.now();
      entry.errorMessage = undefined;
      this.notifyChange();
    }
  }
  
  getEntryById(tempId: string): ProcessingEntry | undefined {
    return this.entries.get(tempId);
  }
  
  getAllEntries(): ProcessingEntry[] {
    return Array.from(this.entries.values());
  }
  
  entriesChanges() {
    return this.entriesSubject.asObservable();
  }
  
  private notifyChange(): void {
    this.entriesSubject.next(this.getAllEntries());
  }
}

export const processingStateManager = new ProcessingStateManager();
