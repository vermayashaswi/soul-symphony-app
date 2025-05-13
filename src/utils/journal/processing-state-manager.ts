
import { BehaviorSubject, Observable } from 'rxjs';
import { showToast } from './toast-helper';

// Define the processing state enum
export enum EntryProcessingState {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

// Define the processing entry type
export interface ProcessingEntry {
  tempId: string;
  entryId?: number;
  startTime: number;
  state: EntryProcessingState;
  errorMessage?: string;
}

export class ProcessingStateManager {
  private processingEntries: ProcessingEntry[] = [];
  private entriesSubject = new BehaviorSubject<ProcessingEntry[]>([]);
  
  constructor() {
    console.log('[ProcessingStateManager] Initialized');
  }
  
  public startProcessing(tempId: string): void {
    // Don't add if already exists
    if (this.isProcessing(tempId)) {
      console.log(`[ProcessingStateManager] Entry ${tempId} already being processed, skipping`);
      return;
    }
    
    const entry: ProcessingEntry = {
      tempId,
      startTime: Date.now(),
      state: EntryProcessingState.PROCESSING
    };
    
    this.processingEntries.push(entry);
    this.notifySubscribers();
    console.log(`[ProcessingStateManager] Started processing ${tempId}`);
  }
  
  public updateEntryState(tempId: string, state: EntryProcessingState, errorMessage?: string): void {
    const entry = this.processingEntries.find(e => e.tempId === tempId);
    if (entry) {
      entry.state = state;
      if (errorMessage) {
        entry.errorMessage = errorMessage;
      }
      this.notifySubscribers();
      console.log(`[ProcessingStateManager] Updated state for ${tempId} to ${state}`);
    }
  }
  
  public setEntryId(tempId: string, entryId: number): void {
    const entry = this.processingEntries.find(e => e.tempId === tempId);
    if (entry) {
      entry.entryId = entryId;
      this.notifySubscribers();
      console.log(`[ProcessingStateManager] Set entry ID for ${tempId} to ${entryId}`);
    }
  }
  
  public removeEntry(tempId: string): void {
    const initialLength = this.processingEntries.length;
    this.processingEntries = this.processingEntries.filter(entry => entry.tempId !== tempId);
    
    if (initialLength !== this.processingEntries.length) {
      this.notifySubscribers();
      console.log(`[ProcessingStateManager] Removed entry ${tempId}`);
    }
  }
  
  public getEntryById(tempId: string): ProcessingEntry | undefined {
    return this.processingEntries.find(entry => entry.tempId === tempId);
  }
  
  public isProcessing(tempId: string): boolean {
    return this.processingEntries.some(entry => entry.tempId === tempId);
  }
  
  public hasError(tempId: string): boolean {
    const entry = this.processingEntries.find(entry => entry.tempId === tempId);
    return entry ? entry.state === EntryProcessingState.ERROR : false;
  }
  
  public getEntryId(tempId: string): number | undefined {
    const entry = this.processingEntries.find(entry => entry.tempId === tempId);
    return entry?.entryId;
  }
  
  public entriesChanges(): Observable<ProcessingEntry[]> {
    return this.entriesSubject.asObservable();
  }
  
  public getProcessingEntries(): ProcessingEntry[] {
    return [...this.processingEntries];
  }
  
  public retryProcessing(tempId: string): void {
    const entry = this.processingEntries.find(e => e.tempId === tempId);
    if (entry && entry.state === EntryProcessingState.ERROR) {
      entry.state = EntryProcessingState.PROCESSING;
      entry.errorMessage = undefined;
      this.notifySubscribers();
      console.log(`[ProcessingStateManager] Retrying processing for ${tempId}`);
    }
  }
  
  public restoreFromLocalStorage(): void {
    try {
      const storedEntries = localStorage.getItem('processingEntries');
      if (storedEntries) {
        this.processingEntries = JSON.parse(storedEntries);
        this.notifySubscribers();
        console.log(`[ProcessingStateManager] Restored ${this.processingEntries.length} entries from localStorage`);
      }
    } catch (error) {
      console.error('[ProcessingStateManager] Error restoring from localStorage:', error);
      // Show error toast
      showToast("Error", "Failed to restore processing state");
    }
  }
  
  public saveToLocalStorage(): void {
    try {
      localStorage.setItem('processingEntries', JSON.stringify(this.processingEntries));
      console.log(`[ProcessingStateManager] Saved ${this.processingEntries.length} entries to localStorage`);
    } catch (error) {
      console.error('[ProcessingStateManager] Error saving to localStorage:', error);
      // Show error toast
      showToast("Error", "Failed to save processing state");
    }
  }
  
  public dispose(): void {
    this.processingEntries = [];
    this.notifySubscribers();
    console.log('[ProcessingStateManager] Disposed state manager');
  }
  
  public clearAll(): void {
    // Add the missing clearAll method
    this.processingEntries = [];
    this.notifySubscribers();
    console.log('[ProcessingStateManager] Cleared all processing entries');
    
    // Also clear from localStorage
    try {
      localStorage.removeItem('processingEntries');
      console.log('[ProcessingStateManager] Cleared processing entries from localStorage');
    } catch (error) {
      console.error('[ProcessingStateManager] Error clearing localStorage:', error);
    }
  }
  
  private notifySubscribers(): void {
    this.entriesSubject.next([...this.processingEntries]);
  }
  
  public handleError(tempId: string, errorMessage: string): void {
    const entry = this.processingEntries.find(e => e.tempId === tempId);
    if (entry) {
      entry.state = EntryProcessingState.ERROR;
      entry.errorMessage = errorMessage;
      this.notifySubscribers();
      
      // Use the showToast helper function instead of direct toast call
      showToast("Error", `Processing failed: ${errorMessage}`);
      
      console.log(`[ProcessingStateManager] Error for ${tempId}: ${errorMessage}`);
    }
  }
}

// Export a singleton instance
export const processingStateManager = new ProcessingStateManager();
